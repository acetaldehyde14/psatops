package com.psap.palletisation.repository;

import com.psap.palletisation.entity.IntegrationResultEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;

public interface IntegrationResultRepository extends JpaRepository<IntegrationResultEntity, Long> {
    Optional<IntegrationResultEntity> findByOrderId(String orderId);
    Optional<IntegrationResultEntity> findByJobId(String jobId);

    @Transactional
    void deleteByOrderId(String orderId);
}
